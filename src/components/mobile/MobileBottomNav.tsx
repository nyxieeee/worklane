import React from 'react';
import { LayoutDashboard, KanbanSquare, Calendar, Inbox, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  page: 'dashboard' | 'board';
  viewMode: 'board' | 'roadmap' | 'calendar';
  showInbox: boolean;
  onGoHome: () => void;
  onSelectBoardView: (view: 'board' | 'roadmap' | 'calendar') => void;
  onOpenBoardSelector?: () => void;
  onCreateBoard: () => void;
  onToggleInbox: () => void;
}

export default function MobileBottomNav({
  page,
  viewMode,
  showInbox,
  onGoHome,
  onSelectBoardView,
  onOpenBoardSelector,
  onCreateBoard,
  onToggleInbox,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Quick Mobile Navigation">
      <button
        type="button"
        className={`mobile-nav-tab ${page === 'dashboard' ? 'active' : ''}`}
        onClick={onGoHome}
        title="Dashboard"
      >
        <LayoutDashboard size={17} />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${page === 'board' && viewMode === 'board' ? 'active' : ''}`}
        onClick={() => {
          if (onOpenBoardSelector) {
            onOpenBoardSelector();
          } else {
            onSelectBoardView('board');
          }
        }}
        title="Board View"
      >
        <KanbanSquare size={17} />
        <span>Board</span>
      </button>

      {/* Prominent Neumorphic Center Circle Plus Button */}
      <div className="mobile-nav-fab-wrapper">
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          type="button"
          className="mobile-nav-fab"
          onClick={onCreateBoard}
          title="Create New Board"
          aria-label="Create New Board"
        >
          <Plus size={22} strokeWidth={2.8} />
        </motion.button>
      </div>

      <button
        type="button"
        className={`mobile-nav-tab ${page === 'board' && viewMode === 'calendar' ? 'active' : ''}`}
        onClick={() => onSelectBoardView('calendar')}
        title="Calendar View"
      >
        <Calendar size={17} />
        <span>Calendar</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${showInbox ? 'active' : ''}`}
        onClick={onToggleInbox}
        title="Inbox"
      >
        <Inbox size={17} />
        <span>Inbox</span>
      </button>
    </nav>
  );
}
