import React from 'react';
import { LayoutDashboard, KanbanSquare, Calendar, Inbox, Plus, Milestone } from 'lucide-react';
import { motion } from 'framer-motion';

interface MobileBottomNavProps {
  page: 'dashboard' | 'board' | 'roadmap';
  viewMode: 'board' | 'roadmap' | 'calendar';
  showInbox: boolean;
  onGoHome: () => void;
  onSelectBoardView: (view: 'board' | 'roadmap' | 'calendar') => void;
  onToggleInbox: () => void;
  onCreateBoard: () => void;
  onOpenBoardSelector?: () => void;
}

export default function MobileBottomNav({
  page,
  viewMode,
  showInbox,
  onGoHome,
  onSelectBoardView,
  onToggleInbox,
  onCreateBoard,
  onOpenBoardSelector,
}: MobileBottomNavProps) {
  const isRoadmap = page === 'roadmap';
  const isMainViewActive = isRoadmap
    ? (page === 'roadmap' && viewMode === 'roadmap')
    : (page === 'board' && viewMode === 'board');

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
        className={`mobile-nav-tab ${isMainViewActive ? 'active' : ''}`}
        onClick={() => {
          if (onOpenBoardSelector) {
            onOpenBoardSelector();
          } else {
            onSelectBoardView(isRoadmap ? 'roadmap' : 'board');
          }
        }}
        title={isRoadmap ? "Roadmap View" : "Board View"}
      >
        {isRoadmap ? <Milestone size={17} /> : <KanbanSquare size={17} />}
        <span>{isRoadmap ? "Roadmap" : "Board"}</span>
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
        className={`mobile-nav-tab ${(page === 'board' || page === 'roadmap') && viewMode === 'calendar' ? 'active' : ''}`}
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
